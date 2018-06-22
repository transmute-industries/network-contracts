pragma solidity ^0.4.24;

contract BlockMiner {
  uint blocksMined;

  function mine() {
    blocksMined += 1;
  }
}
