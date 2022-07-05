// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  // const token = await deployments.get('MockERC20');
  const TOKEN = '0x34769d3e122c93547836addd3eb298035d68f1c3';
  const LP = '0xF06550C34946D251C2EACE59fF4336168dB7EbF2';

  const RewardsMinter = await deploy('RewardsMinter', {
    from: deployer,
    log: true,
    args: [TOKEN],
  });

  const Rewards = await deploy('Rewards', {
    from: deployer,
    log: true,
    args: [LP, RewardsMinter.address],
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
