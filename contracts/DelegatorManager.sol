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

  enum DelegatorStatus { Unbonded, Unbonding, Bonded }

  struct Delegator {
    address delegateAddress;
    uint amountBonded;
  }

  uint public numberOfDelegators;
  mapping(address => Delegator) public delegators;

  struct UnbondingInformation {
    uint withdrawBlock;
    uint amount;
  }

  mapping (address => UnbondingInformation) public unbondingInformations;
}
