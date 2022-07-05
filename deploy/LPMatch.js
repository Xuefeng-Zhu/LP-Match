// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const UNI_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

  // const token = await deploy('MockERC20', {
  //   from: deployer,
  //   args: ['Mock Coin', 'MOCK'],
  //   log: true,
  // });

  const TOKEN = '0x34769d3e122c93547836addd3eb298035d68f1c3';
  const Rewards = await deployments.get('Rewards');

  const LPMatch = await deploy('LPMatch', {
    from: deployer,
    args: [UNI_ROUTER, Rewards.address, TOKEN],
    log: true,
  });

  // await execute(
  //   'MockERC20',
  //   { from: deployer, log: true },
  //   'mint',
  //   LPMatch.address,
  //   '10000000000000000000000'
  // );

  // await execute(
  //   'LPMatch',
  //   { from: deployer, log: true },
  //   'setPriceServer',
  //   deployer
  // );
};

func.tags = ['LPMatch'];
func.dependencies = ['Reward'];
module.exports = func;
