// SPDX-License-Identifier: MIT

pragma solidity 0.6.6;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol";
import "@uniswap/lib/contracts/libraries/FixedPoint.sol";

contract LPMatch is AccessControl {
    using SafeMath for uint256;
    using FixedPoint for *;

    bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED_ROLE");
    uint256 public constant PERIOD = 1 minutes;

    address public immutable pair;
    address public immutable WETH;
    address public immutable token;
    IUniswapV2Router02 public immutable router;

    uint256 public priceCumulativeLast;
    uint32 public blockTimestampLast;
    uint256 public protocolLP;
    FixedPoint.uq112x112 public priceAverage;

    mapping(address => uint256) public userLP;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender));
        _;
    }

    modifier onlyWhitelist() {
        require(hasRole(WHITELISTED_ROLE, msg.sender));
        _;
    }

    constructor(
        IUniswapV2Router02 _router,
        address _WETH,
        address _token
    ) public {
        require(address(_router) != address(0));
        require(_WETH != address(0));
        require(_token != address(0));

        router = _router;
        WETH = _WETH;
        token = _token;

        address _pair = UniswapV2Library.pairFor(
            _router.factory(),
            _token,
            _WETH
        );
        pair = _pair;

        priceCumulativeLast = IUniswapV2Pair(_pair).price0CumulativeLast();
        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = IUniswapV2Pair(_pair)
            .getReserves();
        require(reserve0 != 0 && reserve1 != 0, "NO_RESERVES");
    }

    function refreshPrice() external {
        (
            uint256 priceCumulative,
            ,
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

    function addLiquidity(uint256 amount, uint256 deadline)
        external
        onlyWhitelist
    {
        require(
            IERC20(WETH).transferFrom(msg.sender, address(this), amount),
            "transfer failed"
        );
        _addLiquidity(amount, deadline);
    }

    function addLiquidityETH(uint256 deadline) external payable onlyWhitelist {
        IWETH(WETH).deposit{value: msg.value}();
        _addLiquidity(msg.value, deadline);
    }

    function withdrawLP(uint256 amount) external {
        require(userLP[msg.sender] >= amount, "not enough balance");
        userLP[msg.sender] = userLP[msg.sender].sub(amount);
        require(IERC20(pair).transfer(msg.sender, amount));
    }

    function adminWithdraw(address token, uint256 amount) external onlyAdmin {
        if (token == pair) {
            require(protocolLP >= amount, "not enough balance");
            protocolLP = protocolLP.sub(amount);
        }

        require(IERC20(token).transfer(msg.sender, amount));
    }

    function _addLiquidity(uint256 amount, uint256 deadline) internal {
        uint256 tokenAmount = priceAverage.mul(amount).decode144();
        (, , uint256 liquidity) = router.addLiquidity(
            token,
            WETH,
            tokenAmount,
            amount,
            0,
            0,
            address(this),
            deadline
        );

        uint256 halfLP = liquidity / 2;
        protocolLP = protocolLP.add(halfLP);
        userLP[msg.sender] = userLP[msg.sender].add(halfLP);
    }
}
