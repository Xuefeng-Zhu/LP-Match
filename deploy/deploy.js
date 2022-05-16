// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const users = ['0xa4d4a980c5cee392e0bcdeecdca29c8a4a24ac35'];
  const allocations = ['1000000000000000000'];

  await deploy('MockERC20', {
    from: deployer,
    args: ['USD Coin', 'USDC'],
    log: true,
  });

  const token = await deployments.get('MockERC20');

  await deploy('LPMatch', {
    from: deployer,
    args: [users, allocations, token.address],
    log: true,
  });
};

func.tags = ['LPMatch'];
module.exports = func;
