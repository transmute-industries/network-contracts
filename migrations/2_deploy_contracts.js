const TST = artifacts.require('./TransmuteToken.sol');
const ProviderRound = artifacts.require('./ProviderRound.sol');
const RoundManager = artifacts.require('./RoundManager.sol');

module.exports = deployer => {
  deployer.deploy(TST);
  deployer.deploy(ProviderRound);
  deployer.deploy(RoundManager);
};
