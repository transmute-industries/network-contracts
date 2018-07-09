pragma solidity ^0.4.24;

import "./SortedDoublyLL.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract ProviderPool is Ownable {
  using SortedDoublyLL for SortedDoublyLL.Data;
  SortedDoublyLL.Data public providerPool;

  // @dev convenience method to access the 'nodes' mapping that lives inside providerPool
  function getProvider(address _provider) external view returns (uint, address, address) {
    SortedDoublyLL.Node memory node = providerPool.nodes[_provider];
    return (node.key, node.nextId, node.prevId);
  }

  function containsProvider(address _provider) external view returns (bool) {
    return providerPool.contains(_provider);
  }

  // TODO: Add default value in the main constructor
  function setMaxNumberOfProviders(uint _maxNumber) external onlyOwner {
    providerPool.setMaxSize(_maxNumber);
  }

  function addProvider(address _provider, uint _bondedAmount) internal {
    providerPool.insert(_provider, _bondedAmount, 0, 0);
  }

  function updateProvider(address _provider, uint _newBondedAmount) internal {
    providerPool.updateKey(_provider, _newBondedAmount, 0, 0);
  }
}
