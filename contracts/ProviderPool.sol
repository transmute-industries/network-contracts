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

  function setMaxNumberOfProviders(uint _maxNumber) external onlyOwner {
    providerPool.setMaxSize(_maxNumber);
  }

  function addProvider(address _providerAddress, uint _bondedAmount) internal {
    providerPool.insert(_providerAddress, _bondedAmount, 0, 0);
  }
}
