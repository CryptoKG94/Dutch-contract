import * as anchor from "@project-serum/anchor";
import { web3 } from "@project-serum/anchor";
import { Connection } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";

const DUTCH_AUCTION_DEVNET_PROGRAM_ID =
  "dtchBqYrywpfV6uKkrrRo8fW56Lg6cfAKMEgTt8sUXx";
const DUTCH_AUCTION_MAINNET_PROGRAM_ID =
  "dtchBqYrywpfV6uKkrrRo8fW56Lg6cfAKMEgTt8sUXx";

export async function getDutchProgram(wallet: Keypair, env: web3.Cluster) {
  const connection = new web3.Connection(web3.clusterApiUrl(env));
  const walletWrapper = new anchor.Wallet(wallet);
  const provider = new anchor.Provider(connection, walletWrapper, {
    preflightCommitment: "recent",
  });
  let program_id: string;
  if (env == "mainnet-beta") {
    program_id = DUTCH_AUCTION_MAINNET_PROGRAM_ID;
  } else {
    program_id = DUTCH_AUCTION_DEVNET_PROGRAM_ID;
  }
  const idl = await anchor.Program.fetchIdl(program_id, provider);

  return new anchor.Program(idl, program_id, provider);
}
