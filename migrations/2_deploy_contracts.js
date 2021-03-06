const TST = artifacts.require('./TransmuteToken.sol');
const TestTransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const RoundManager = artifacts.require('./RoundManager.sol');
const SortedDoublyLL = artifacts.require('./SortedDoublyLL.sol');
const TestProviderPool = artifacts.require('./TestProviderPool.sol');
const TestJobManager = artifacts.require('./TestJobManager.sol');
const PseudoRandomNumberGenerator = artifacts.require('./PseudoRandomNumberGenerator.sol');

module.exports = (deployer) => {
  deployer.deploy(TST);
  deployer.deploy(SortedDoublyLL);
  deployer.link(SortedDoublyLL, TestProviderPool);
  deployer.deploy(TestProviderPool);
  deployer.link(SortedDoublyLL, RoundManager);
  deployer.deploy(RoundManager);
  deployer.link(SortedDoublyLL, TestTransmuteDPOS);
  deployer.deploy(TestTransmuteDPOS);
  deployer.link(SortedDoublyLL, TestJobManager);
  deployer.deploy(TestJobManager);
  deployer.deploy(PseudoRandomNumberGenerator);
};
