// Just a standard hardhat-deploy deployment definition file!
const func = async (hre) => {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  if (chainId != '1') {
    await deploy('MockERC20', {
      from: deployer,
      log: true,
      args: ['Numis', 'NUME'],
    });
  }
};

func.tags = ['MockToken'];
func.dependencies = [];
module.exports = func;
