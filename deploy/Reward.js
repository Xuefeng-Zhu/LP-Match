// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  let TOKEN = '0x34769d3e122c93547836addd3eb298035d68f1c3';
  let LP = '0xF06550C34946D251C2EACE59fF4336168dB7EbF2';

  if (chainId != '1') {
    const token = await deployments.get('MockERC20');
    TOKEN = token.address;

    LP = '0x39c002562A8e7A5e069b356Cb3C85926dBaDa6fE';
  }

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

  if (chainId != '1') {
    await execute(
      'MockERC20',
      { from: deployer, log: true },
      'mint',
      RewardsMinter.address,
      '10000000000000000000000'
    );
  }
};

func.tags = ['Reward'];
func.dependencies = ['MockToken'];
module.exports = func;
