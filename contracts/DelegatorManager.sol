pragma solidity ^0.4.24;

contract DelegatorManager {
  event DelegatorBonded(
    address indexed delegator,
    address indexed provider,
    uint amount
  );

  event DelegatorUnbonded(
    address indexed delegator,
    address indexed provider,
    uint amount
  );

  enum DelegatorStatus { Unbonded, UnbondedWithTokensToWithdraw, Bonded }

  struct Delegator {
    address delegateAddress;
    uint amountBonded;
  }

  uint public numberOfDelegators;
  mapping(address => Delegator) public delegators;

  struct WithdrawInformation {
    uint withdrawBlock;
    uint amount;
  }

  mapping (address => WithdrawInformation) public withdrawInformations;
}
