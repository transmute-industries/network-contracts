const TST = artifacts.require('./TransmuteToken.sol');
const ProviderRound = artifacts.require('./ProviderRound.sol');
const RoundManager = artifacts.require('./RoundManager.sol');
const SortedDoublyLL = artifacts.require('./SortedDoublyLL.sol');
const TestProviderPool = artifacts.require('./TestProviderPool.sol');

module.exports = deployer => {
  deployer.deploy(TST);
  deployer.deploy(ProviderRound);
  deployer.deploy(RoundManager);
  deployer.deploy(SortedDoublyLL);
  deployer.link(SortedDoublyLL, TestProviderPool);
  deployer.deploy(TestProviderPool);
};
