const TST = artifacts.require('./TransmuteToken.sol');
const ProviderRound = artifacts.require('./ProviderRound.sol');
const TimeManager = artifacts.require('./TimeManager.sol');

module.exports = deployer => {
  deployer.deploy(TST);
  deployer.deploy(ProviderRound);
  deployer.deploy(TimeManager);
};
