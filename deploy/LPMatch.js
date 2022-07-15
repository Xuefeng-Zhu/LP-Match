// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const UNI_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  let TOKEN = '0x34769d3e122c93547836addd3eb298035d68f1c3';

  if (chainId != '1') {
    const token = await deployments.get('MockERC20');
    TOKEN = token.address;
  }

  const Rewards = await deployments.get('Rewards');

  const LPMatch = await deploy('LPMatch', {
    from: deployer,
    args: [UNI_ROUTER, Rewards.address, TOKEN],
    log: true,
  });

  if (chainId != '1') {
    await execute(
      'MockERC20',
      { from: deployer, log: true },
      'mint',
      LPMatch.address,
      '10000000000000000000000'
    );

    // await execute(
    //   'LPMatch',
    //   { from: deployer, log: true },
    //   'setPriceServer',
    //   '0x83557abedb8dae954e61c26153d9b3c323e61032'
    // );

    await execute(
      'LPMatch',
      { from: deployer, log: true },
      'setEnableWhitelist',
      false
    );
  }
};

func.tags = ['LPMatch'];
func.dependencies = ['Reward'];
module.exports = func;
