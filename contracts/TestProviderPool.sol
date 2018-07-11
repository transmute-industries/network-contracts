pragma solidity ^0.4.24;

import "../contracts/ProviderPool.sol";

contract TestProviderPool is ProviderPool {

  // @dev convenience method to be able to call addProvider from web3js (it has internal visibility)
  function publicAddProvider(address _provider, uint _bondedAmount) public {
    addProvider(_provider, _bondedAmount);
  }

  // @dev convenience method to be able to call updateProvider from web3js (it has internal visibility)
  function publicUpdateProvider(address _provider, uint _bondedAmount) public {
    updateProvider(_provider, _bondedAmount);
  }

  // @dev convenience method to be able to call removeProvider from web3js (it has internal visibility)
  function publicRemoveProvider(address _provider) public {
    removeProvider(_provider);
  }
}

