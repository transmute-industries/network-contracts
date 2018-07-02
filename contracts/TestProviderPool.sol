pragma solidity ^0.4.24;

import "../contracts/ProviderPool.sol";

contract TestProviderPool is ProviderPool {
  // @dev convenience method to access from web3js the 'nodes' mapping that lives inside SortedDoublyLL.Data
  function get(address _provider) returns (uint, address, address) {
    return (providerPool.nodes[_provider].key, providerPool.nodes[_provider].nextId, providerPool.nodes[_provider].prevId);
  }

  // @dev convenience method to be able to call addProvider from web3js (it has internal visibility)
  function publicAddProvider(address _providerAddress, uint _bondedAmount) public {
    addProvider(_providerAddress, _bondedAmount);
  }
}

