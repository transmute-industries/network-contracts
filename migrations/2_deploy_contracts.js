const TST = artifacts.require('./TransmuteToken.sol');
const TestTransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const TestRoundManager = artifacts.require('./TestRoundManager.sol');
const SortedDoublyLL = artifacts.require('./SortedDoublyLL.sol');
const TestProviderPool = artifacts.require('./TestProviderPool.sol');
const JobManager = artifacts.require('./JobManager.sol');

module.exports = (deployer) => {
  deployer.deploy(TST);
  deployer.deploy(SortedDoublyLL);
  deployer.link(SortedDoublyLL, TestProviderPool);
  deployer.deploy(TestProviderPool);
  deployer.link(SortedDoublyLL, TestRoundManager);
  deployer.deploy(TestRoundManager);
  deployer.link(SortedDoublyLL, TestTransmuteDPOS);
  deployer.deploy(TestTransmuteDPOS);
  deployer.deploy(JobManager);
};
