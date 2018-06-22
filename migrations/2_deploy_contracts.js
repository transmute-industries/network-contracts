const TST = artifacts.require('./TransmuteToken.sol');
const ProviderRound = artifacts.require('./ProviderRound.sol');
const TimeManager = artifacts.require('./TimeManager.sol');
const BlockMiner = artifacts.require('./BlockMiner.sol');

module.exports = deployer => {
  deployer.deploy(TST);
  deployer.deploy(ProviderRound);
  deployer.deploy(TimeManager);
  deployer.deploy(BlockMiner);
};
