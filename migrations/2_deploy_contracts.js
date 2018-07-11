const TST = artifacts.require('./TransmuteToken.sol');
const TransmuteDPOS = artifacts.require('./TransmuteDPOS.sol');
const RoundManager = artifacts.require('./RoundManager.sol');
const SortedDoublyLL = artifacts.require('./SortedDoublyLL.sol');
const TestProviderPool = artifacts.require('./TestProviderPool.sol');

module.exports = deployer => {
  deployer.deploy(TST);
  deployer.deploy(SortedDoublyLL);
  deployer.link(SortedDoublyLL, TransmuteDPOS);
  deployer.deploy(TransmuteDPOS);
  deployer.deploy(RoundManager);
  deployer.link(SortedDoublyLL, TestProviderPool);
  deployer.deploy(TestProviderPool);
};
