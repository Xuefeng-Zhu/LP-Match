// SPDX-License-Identifier: MIT

pragma solidity 0.6.6;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol";
import "@uniswap/lib/contracts/libraries/FixedPoint.sol";

interface IRewards {
    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function claim() external;

    function reward() external returns (IERC20);
}

contract LPMatch is AccessControl {
    using SafeMath for uint256;
    using FixedPoint for *;

    bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED_ROLE");
    uint256 public constant PERIOD = 1 minutes;

    address public immutable pair;
    address public immutable WETH;
    address public immutable token;
    IUniswapV2Router02 public immutable router;
    IRewards public immutable rewards;

    bool public enableWhitelist;
    uint256 public accRewardsPerLP;
    uint256 public priceCumulativeLast;
    uint32 public blockTimestampLast;
    uint256 public protocolLP;
    FixedPoint.uq112x112 public priceAverage;

    mapping(address => uint256) public userLP;
    mapping(address => uint256) public userClaimed;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "not admin");
        _;
    }

    modifier onlyWhitelist() {
        if (enableWhitelist) {
            require(hasRole(WHITELISTED_ROLE, msg.sender));
        }
        _;
    }

    constructor(
        IUniswapV2Router02 _router,
        IRewards _rewards,
        address _token
    ) public {
        require(address(_router) != address(0));
        require(address(_rewards) != address(0));
        require(_token != address(0));

        address _WETH = _router.WETH();
        router = _router;
        rewards = _rewards;
        WETH = _WETH;
        token = _token;

        address _pair = UniswapV2Library.pairFor(
            _router.factory(),
            _token,
            _WETH
        );
        pair = _pair;

        priceCumulativeLast = IUniswapV2Pair(_pair).price1CumulativeLast();
        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = IUniswapV2Pair(_pair)
            .getReserves();
        require(reserve0 != 0 && reserve1 != 0, "NO_RESERVES");

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(WHITELISTED_ROLE, msg.sender);
        IERC20(_WETH).approve(address(_router), uint256(-1));
        IERC20(_token).approve(address(_router), uint256(-1));
    }

    function refreshPrice() public {
        (
            ,
            uint256 priceCumulative,
            uint32 blockTimestamp
        ) = UniswapV2OracleLibrary.currentCumulativePrices(pair);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired

        // ensure that at least one full period has passed since the last update
        if (timeElapsed < PERIOD) {
            return;
        }

        // overflow is desired, casting never truncates
        // cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
        priceAverage = FixedPoint.uq112x112(
            uint224((priceCumulative - priceCumulativeLast) / timeElapsed)
        );

        priceCumulativeLast = priceCumulative;
        blockTimestampLast = blockTimestamp;
    }

    function addLiquidity(uint256 amount) external onlyWhitelist {
        require(
            IERC20(WETH).transferFrom(msg.sender, address(this), amount),
            "transfer failed"
        );
        _addLiquidity(amount);
    }

    function addLiquidityETH() external payable onlyWhitelist {
        IWETH(WETH).deposit{value: msg.value}();
        _addLiquidity(msg.value);
    }

    function withdrawLP(uint256 amount) external {
        require(userLP[msg.sender] >= amount, "not enough balance");

        _claim(msg.sender);
        rewards.withdraw(amount);
        userLP[msg.sender] = userLP[msg.sender].sub(amount);
        require(IERC20(pair).transfer(msg.sender, amount));
    }

    function adminWithdraw(address tokenToWithdraw, uint256 amount)
        external
        onlyAdmin
    {
        if (tokenToWithdraw == pair) {
            require(protocolLP >= amount, "not enough balance");
            protocolLP = protocolLP.sub(amount);
        }

        require(IERC20(tokenToWithdraw).transfer(msg.sender, amount));
    }

    function setEnableWhitelist(bool _enableWhitelist) external onlyAdmin {
        enableWhitelist = _enableWhitelist;
    }

    function claim() external {
        _claim(msg.sender);
    }

    function _addLiquidity(uint256 amount) internal {
        refreshPrice();
        uint256 tokenAmount = priceAverage.mul(amount).decode144();
        (, , uint256 liquidity) = router.addLiquidity(
            token,
            WETH,
            tokenAmount,
            amount,
            0,
            0,
            address(this),
            now
        );

        _claim(msg.sender);
        rewards.deposit(liquidity);
        uint256 halfLP = liquidity / 2;
        protocolLP = protocolLP.add(halfLP);
        userLP[msg.sender] = userLP[msg.sender].add(halfLP);
        require(
            IERC20(WETH).transfer(
                msg.sender,
                IERC20(WETH).balanceOf(address(this))
            )
        );
    }

    function _claim(address user) internal {
        IERC20 rewardToken = rewards.reward();
        uint256 rewardBalance = rewardToken.balanceOf(address(this));

        rewards.claim();

        accRewardsPerLP = accRewardsPerLP.add(
            (rewardToken.balanceOf(address(this)).sub(rewardBalance) * 1e18) /
                protocolLP
        );

        uint256 pastUserClaimed = userClaimed[user];
        userClaimed[user] = (userLP[user] * accRewardsPerLP) / 1e18;
        rewardToken.transfer(user, userClaimed[user].sub(pastUserClaimed));
    }
}
