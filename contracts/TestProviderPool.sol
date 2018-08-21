pragma solidity ^0.4.24;

import "./ProviderPool.sol";

// This contract adds public methods to be able to call internal methods from web3js
contract TestProviderPool is ProviderPool {

  function publicAddProvider(address _provider, uint _bondedAmount) public {
    addProvider(_provider, _bondedAmount);
  }

  function publicUpdateProvider(address _provider, uint _bondedAmount) public {
    updateProvider(_provider, _bondedAmount);
  }

  function publicRemoveProvider(address _provider) public {
    removeProvider(_provider);
  }
}

