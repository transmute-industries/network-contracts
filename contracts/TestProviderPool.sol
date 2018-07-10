pragma solidity ^0.4.24;

import "../contracts/ProviderPool.sol";

contract TestProviderPool is ProviderPool {

  // @dev convenience method to be able to call addProvider from web3js (it has internal visibility)
  function publicAddProvider(address _providerAddress, uint _bondedAmount) public {
    addProvider(_providerAddress, _bondedAmount);
  }

  // @dev convenience method to be able to call updateProvider from web3js (it has internal visibility)
  function publicUpdateProvider(address _providerAddress, uint _bondedAmount) public {
    updateProvider(_providerAddress, _bondedAmount);
  }
}

