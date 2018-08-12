pragma solidity ^0.4.24;

import "../contracts/RoundManager.sol";

// This contract adds public methods to be able to call internal methods from web3js
contract TestRoundManager is RoundManager {
  function publicRemoveActiveProvider(address _provider) public {
    removeActiveProvider(_provider);
  }
}

