pragma solidity ^0.4.24;

import "./SortedDoublyLL.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract ProviderPool is Ownable {

  // TODO: init
  uint public numberOfActiveProviders;

  using SortedDoublyLL for SortedDoublyLL.Data;
  // TODO: Change visibility ?
  SortedDoublyLL.Data public providerPool;

  function setProviderPoolMaxSize(uint _maxNumber) external onlyOwner {
    // TODO: Remove limitation providerPool.maxSize = _maxNumber;
    providerPool.setMaxSize(_maxNumber);
  }

  function setNumberOfActiveProviders(uint _numberOfActiveProviders) external onlyOwner {
    require(_numberOfActiveProviders <= providerPool.maxSize);
    numberOfActiveProviders = _numberOfActiveProviders;
  }

  // @dev convenience method to access the 'nodes' mapping that lives inside providerPool
  function getProvider(address _provider) external view returns (uint, address, address) {
    SortedDoublyLL.Node memory node = providerPool.nodes[_provider];
    return (node.key, node.nextId, node.prevId);
  }

  function containsProvider(address _provider) external view returns (bool) {
    return providerPool.contains(_provider);
  }

  function addProvider(address _provider, uint _bondedAmount) internal {
    providerPool.insert(_provider, _bondedAmount, 0, 0);
  }

  function updateProvider(address _provider, uint _newBondedAmount) internal {
    providerPool.updateKey(_provider, _newBondedAmount, 0, 0);
  }

  function removeProvider(address _provider) internal {
    providerPool.remove(_provider);
  }

  // Getter functions for providerPool
  function getFirstProvider() public view returns (address) {
    return providerPool.getFirst();
  }

  function getNextProvider(address _provider) public view returns (address) {
    return providerPool.getNext(_provider);
  }

  function getProviderStake(address _provider) public view returns (uint) {
    return providerPool.nodes[_provider].key;
  }

  function getProviderPoolSize() public view returns (uint) {
    return providerPool.size;
  }

}
