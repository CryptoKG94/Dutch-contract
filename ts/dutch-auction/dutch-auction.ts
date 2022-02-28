import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { web3 } from "@project-serum/anchor";

import { getDutchProgram } from "./utils";

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
const METADATA_PREFIX = "metadata";

export const initEscrow = async (
  wallet: Keypair,
  env: web3.Cluster,
  startingPrice: number,
  reservedPrice: number,
  priceStep: number,
  interval: number,
  initializer: PublicKey,
  tokenAccount: PublicKey,
  mintAccount: PublicKey,
  escrowKP: Keypair
) => {
  const dutchProgram = await getDutchProgram(wallet, env);
  const escrowAccount = escrowKP.publicKey;
  dutchProgram.rpc.initEscrow(
    new anchor.BN(startingPrice),
    new anchor.BN(reservedPrice),
    new anchor.BN(priceStep),
    new anchor.BN(interval),
    {
      accounts: {
        initializer,
        tokenAccount,
        mintAccount,
        escrowAccount,
        salesTaxRecipient: new PublicKey(
          "8Ba7LXjBTWScPKMV4Lmz5dsenz53NVAwJsKYXyf7TzFZ"
        ),
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: new PublicKey(TOKEN_PROGRAM_ID),
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      instructions: [
        await dutchProgram.account.swapEscrowAccount.createInstruction(
          escrowKP
        ),
      ],
      signers: [initializer, escrowKP],
    }
  );
};

export const dutchAuction = async (
  wallet: Keypair,
  env: web3.Cluster,
  taker: PublicKey,
  takerTokenAccount: PublicKey,
  initializer: PublicKey,
  initializerTokenAccount: PublicKey,
  mintAccount: PublicKey,
  escrowAccount: PublicKey
) => {
  const dutchProgram = await getDutchProgram(wallet, env);
  const [token_authority_pda, _token_authority_bump] =
    await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("dutchauction"))],
      dutchProgram.programId
    );
  const metadataAccount = await PublicKey.findProgramAddress(
    [
      Buffer.from(METADATA_PREFIX),
      METADATA_PROGRAM_ID.toBuffer(),
      mintAccount.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  dutchProgram.rpc.dutchAuction({
    accounts: {
      taker,
      takerTokenAccount,
      initializer,
      initializerTokenAccount,
      mintAccount,
      escrowAccount,
      salesTaxRecipient: new PublicKey(
        "8Ba7LXjBTWScPKMV4Lmz5dsenz53NVAwJsKYXyf7TzFZ"
      ),
      tokenAuthority: token_authority_pda,
      metadataAccount,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: new PublicKey(TOKEN_PROGRAM_ID),
      clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    },
  });
};
