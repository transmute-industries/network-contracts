const TST = artifacts.require('./TransmuteToken.sol');
const ProviderRound = artifacts.require('./ProviderRound.sol');

module.exports = deployer => {
  deployer.deploy(TST);
  deployer.deploy(ProviderRound);
};
