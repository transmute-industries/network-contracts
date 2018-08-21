pragma solidity ^0.4.24;

import "./TransmuteDPOS.sol";

// This contract adds public methods to be able to call internal methods from web3js
contract TestTransmuteDPOS is TransmuteDPOS {
  function publicRemoveActiveProvider(address _provider) public {
    removeActiveProvider(_provider);
  }
}

