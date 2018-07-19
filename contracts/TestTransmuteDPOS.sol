pragma solidity ^0.4.24;

import "../contracts/TransmuteDPOS.sol";

// This contract adds public methods to be able to call internal methods from web3js
contract TestTransmuteDPOS is TransmuteDPOS {
  function publicResignAsProvider(address _provider) public {
    resignAsProvider(_provider);
  }
}

