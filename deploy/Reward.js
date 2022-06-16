// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const token = await deployments.get('MockERC20');

  const RewardsMinter = await deploy('RewardsMinter', {
    from: deployer,
    log: true,
    args: [token.address],
  });

  const Rewards = await deploy('Rewards', {
    from: deployer,
    log: true,
    args: ['0xF7f8da8567C584E49f4c2043fa097A0ff980A95f', RewardsMinter.address],
  });

  if (RewardsMinter.newlyDeployed) {
    await execute(
      'RewardsMinter',
      { from: deployer, log: true },
      'setMinter',
      Rewards.address
    );
  }
};

func.tags = ['Reward'];
module.exports = func;
