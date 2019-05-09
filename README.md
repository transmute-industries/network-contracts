# Transmute Network Contracts [![Build Status](https://travis-ci.org/transmute-industries/network-contracts.svg?branch=master)](https://travis-ci.org/transmute-industries/network-contracts) [![Coverage Status](https://coveralls.io/repos/github/transmute-industries/network-contracts/badge.svg?branch=master)](https://coveralls.io/github/transmute-industries/network-contracts?branch=master)

This repo contains the smart contracts that are under development for the **Delegated Proof of Stake** layer of the Transmute Platform: A marketplace for decentralized storage. For more information about the Platorm check out our [Whitepaper](https://www.transmute.industries/whitepaper.pdf)

![Transmute Network Diagram](./transmute_network_diagram.png)


Check out the [wiki](https://github.com/transmute-industries/network-contracts/wiki) for more information about the contracts and the DPOS implementation.

- [Delegator States](https://github.com/transmute-industries/network-contracts/wiki/Delegator-States): What are the different states a `Delegator` can be in
- [DPOS Rounds debate](https://github.com/transmute-industries/network-contracts/wiki/DPOS-Rounds-debate): Possible implementations of the DPOS Rounds, and the motivation behind the choice we made for Transmute
- [DPOS Specs](https://github.com/transmute-industries/network-contracts/wiki/DPOS-Specs): The mechanisms of Transmute DPOS with detailed steps and explanations of their implication.
- [Provider Pool](https://github.com/transmute-industries/network-contracts/wiki/Provider-Pool): What data structure is used to store `Providers`
- [Provider States](https://github.com/transmute-industries/network-contracts/wiki/Provider-States): What are the different states a `Provider` can be in
- [Testing internal methods](https://github.com/transmute-industries/network-contracts/wiki/Testing-internal-methods): How we test contracts' internal methods

# Run the project locally

## Install the project

```
npm install
```

## Run the tests

```
npm run ganache # in a separate shell
```

### Running the unit tests of every smart contract

```
npm run test:unit
```

### Running the integration test of the Delegated Proof of Stake consensus in action

```
npm run test:integration
```
