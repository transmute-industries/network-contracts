pragma solidity ^0.4.24;

contract PseudoRandomNumberGenerator {
  function getPseudoRandomNumber() public view returns (uint) {
    // Here we generate entropy by xoring together properties that
    // are hard / impossible to all manipulate at the same time
    // by a single actor

    // msg.sender can be manipulated for a user because he can
    // create new addresses very easily but it's impossible to
    // manipulate for a miner because he has no control over it
    bytes32 a = keccak256(abi.encode(msg.sender));
    // blockhash is hard to manipulate for a user because he will
    // have a short timeframe to send the transaction hoping it
    // gets mined in the very next block, but it is easy to manipulate
    // for a miner because they can wait for more blocks before adding
    // the transaction
    bytes32 b = keccak256(abi.encode(blockhash(block.number - 1)));
    // Note: we can add more entropy by xoring the keccak256 hashes
    // of local variables in the state of the contract
    return uint(a) ^ uint(b);
  }
}
