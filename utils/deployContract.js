require('dotenv').config();
const { ethers } = require("ethers")
const solc = require('solc');

const { getUserDetails } = require('./firebase');
const { decryptMnemonic } = require("./secureBundle")


async function deployContract(id, pass, contractFileName, contractCode, constructorArgs) {
    try {
        const userD = await getUserDetails(id)

        const decrypted = await decryptMnemonic(pass.toString(), JSON.parse(userD.data.encryptedData))

        if (decrypted.status === 200) {

            const input = {
                language: 'Solidity',
                sources: { [contractFileName]: { content: contractCode } },
                settings: { outputSelection: { '*': { '*': ['*'] } } }
            }

            const output = JSON.parse(solc.compile(JSON.stringify(input)));

            if (output.errors) {
                return ({ status: 400, data: output.errors[0].formattedMessage, msg: "An error occurred while compiling the contract! Please look that it doesn't have imports and is using the latest solidity compiler version." })
            }
            else {
                var contractName;
                for (var cn in output.contracts[contractFileName]) { contractName = cn }
                const bytecode = output.contracts[contractFileName][contractName].evm.bytecode.object;
                const ABI = output.contracts[contractFileName][contractName].abi;

                const provider = new ethers.providers.JsonRpcProvider(process.env.GOERLI_RPC);
                const wallet = ethers.Wallet.fromMnemonic(decrypted.data.mnemonic, decrypted.data.derivationPath)
                const signer = wallet.connect(provider)

                try {
                    const factory = new ethers.ContractFactory(ABI, bytecode, signer)

                    // const ae = factory.getDeployTransaction(constructorArgs)
                    // console.log(ae.gasLimit)
                    // console.log(ae.gasPrice)
                    // console.log(ae.value)
                    // const gasEstim = await provider.estimateGas(ae.data)
                    // console.log(ethers.utils.formatEther(gasEstim))

                    const contract = await factory.deploy(constructorArgs)
                    const result = await contract.deployTransaction.wait()

                    return ({
                        status: 200,
                        data: {
                            contractAddress: result.contractAddress,
                            transactionHash: result.transactionHash,
                            gasFeePaid: ethers.utils.formatUnits(result.gasUsed.mul(result.effectiveGasPrice).toString(), "ether")
                        },
                        msg: "Contract deployment successful!"
                    })
                }
                catch (err) {
                    if (err.message.includes("contract creation code storage out of gas")) {
                        return ({ status: 400, data: err, msg: "Contract deployment failed! Insufficient funds in the wallet." })
                    }
                    else {
                        return ({ status: 400, data: err, msg: "Contract deployment failed! Please check if the constructor arguments are correct." })
                    }
                }
            }
        }
        else {
            return (decrypted)
        }

    } catch (err) {
        console.log(err);
        return ({ status: 400, data: err, msg: "Unknown error occurred!" })
    }
}

module.exports = { deployContract }
