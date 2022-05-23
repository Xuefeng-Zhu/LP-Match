// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const UNI_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

  // await deploy('MockERC20', {
  //   from: deployer,
  //   args: ['USD Coin', 'USDC'],
  //   log: true,
  // });

  const token = await deployments.get('MockERC20');

  await deploy('LPMatch', {
    from: deployer,
    args: [UNI_ROUTER, token.address],
    log: true,
  });
};

func.tags = ['LPMatch'];
module.exports = func;
