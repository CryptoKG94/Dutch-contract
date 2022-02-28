import * as anchor from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PublicKey, sendAndConfirmTransaction, Transaction
} from "@solana/web3.js";
import assert from "assert";
import { createMetadata, Creator, Data } from "./metadata/metadata";


describe("dutch-auction", () => {
  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey(
    "dtchBqYrywpfV6uKkrrRo8fW56Lg6cfAKMEgTt8sUXx"
  );
  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/dutch_auction.json", "utf8")
  );

  const myWallet = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(require("fs").readFileSync(process.env.MY_WALLET, "utf8"))
    )
  );

  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com/",
    "recent"
  );

  const walletWrapper = new anchor.Wallet(myWallet);

  const provider = new anchor.Provider(connection, walletWrapper, {
    preflightCommitment: "recent",
    skipPreflight: true,
  });

  const program = new anchor.Program(idl, programId, provider);

  const startingPrice = 10000;
  const reservedPrice = 5000;
  const priceStep = 1000;
  const interval = 1;
  let startingTs: number;

  const salesTaxRecipientPubkey = new PublicKey(
    "3iYf9hHQPciwgJ1TCjpRUp1A3QW4AfaK7J6vCmETRMuu"
  );

  const mintAuthority = anchor.web3.Keypair.generate();

  const initializer = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(
        require("fs").readFileSync("./tests/keys/initalizer.json", "utf8")
      )
    )
  );
  const taker = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(require("fs").readFileSync("./tests/keys/taker.json", "utf8"))
    )
  );

  const creator1 = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(
        require("fs").readFileSync("./tests/keys/creator1.json", "utf8")
      )
    )
  );
  const creator2 = anchor.web3.Keypair.generate();

  let mint: Token;
  let tokenPubkey: PublicKey;
  let tokenAuthorityPda: PublicKey;
  let metadata: PublicKey;
  let auction: PublicKey;
  let auctionBump: number;

  it("Init Auction", async () => {
    // create nft related stuff
    mint = await Token.createMint(
      connection,
      initializer,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    tokenPubkey = await mint.createAccount(initializer.publicKey);
    await mint.mintTo(tokenPubkey, mintAuthority.publicKey, [mintAuthority], 1);

    const signers = [creator1, mintAuthority];
    let instructions = [];
    metadata = await createMetadata(
      new Data({
        name: "somename",
        symbol: "SOME",
        uri: "https://somelink.come/someid",
        sellerFeeBasisPoints: 500,
        creators: [
          new Creator({
            address: creator1.publicKey,
            verified: true,
            share: 80,
          }),
          new Creator({
            address: creator2.publicKey,
            verified: false,
            share: 20,
          }),
        ],
      }),
      creator1.publicKey, // update authority
      mint.publicKey,
      mintAuthority.publicKey, // mint authority
      instructions,
      creator1.publicKey
    );
    const transaction = new Transaction();
    instructions.forEach((instruction) => transaction.add(instruction));
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash("singleGossip")
    ).blockhash;

    transaction.setSigners(...signers.map((s) => s.publicKey));
    // transaction.partialSign(...signers);

    await sendAndConfirmTransaction(connection, transaction, signers, {
      skipPreflight: true,
    });
  });

  it("Auction Cancel", async () => {
    // init auction
    [auction, auctionBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("dutchauction")),
        initializer.publicKey.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [_token_authority_pda, token_authority_bump] =
      await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("dutchauction"))],
        program.programId
      );

    tokenAuthorityPda = _token_authority_pda;
    const tx = await program.rpc.initAuction(
      new anchor.BN(startingPrice),
      new anchor.BN(reservedPrice),
      new anchor.BN(priceStep),
      new anchor.BN(interval),
      auctionBump,
      {
        accounts: {
          initializer: initializer.publicKey,
          tokenAccount: tokenPubkey,
          mintAccount: mint.publicKey,
          tokenAuthority: tokenAuthorityPda,
          auctionAccount: auction,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [initializer],
      }
    );

    console.log("list:", tx);
    const token = await mint.getAccountInfo(tokenPubkey);

    const auctionAccount = await program.account.auctionAccount.fetch(auction);
    startingTs = auctionAccount.startingTs.toNumber();
    assert.ok(auctionAccount.initializerPubkey.equals(initializer.publicKey));
    assert.ok(auctionAccount.mintPubkey.equals(mint.publicKey));
    assert.ok(auctionAccount.tokenAccountPubkey.equals(tokenPubkey));
    assert.ok(auctionAccount.startingPrice.toNumber() == startingPrice);
    assert.ok(auctionAccount.reservedPrice.toNumber() == reservedPrice);
    assert.ok(auctionAccount.priceStep.toNumber() == priceStep);
    assert.ok(auctionAccount.interval.toNumber() == interval);

    const txCancel = await program.rpc.cancelAuction({
      accounts: {
        initializer: initializer.publicKey,
        tokenAccount: tokenPubkey,
        mintAccount: mint.publicKey,
        auctionAccount: auction,
        tokenAuthority: tokenAuthorityPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [initializer],
    });
    console.log("cancel", txCancel);
  });

  it("Init Auction success", async () => {
    // init auction
    [auction, auctionBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("dutchauction")),
        initializer.publicKey.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [_token_authority_pda, token_authority_bump] =
      await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("dutchauction"))],
        program.programId
      );

    tokenAuthorityPda = _token_authority_pda;
    const tx = await program.rpc.initAuction(
      new anchor.BN(startingPrice),
      new anchor.BN(reservedPrice),
      new anchor.BN(priceStep),
      new anchor.BN(interval),
      auctionBump,
      {
        accounts: {
          initializer: initializer.publicKey,
          tokenAccount: tokenPubkey,
          mintAccount: mint.publicKey,
          tokenAuthority: tokenAuthorityPda,
          auctionAccount: auction,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [initializer],
      }
    );

    console.log("list:", tx);

    const token = await mint.getAccountInfo(tokenPubkey);

    const auctionAccount = await program.account.auctionAccount.fetch(auction);
    startingTs = auctionAccount.startingTs.toNumber();
    assert.ok(auctionAccount.initializerPubkey.equals(initializer.publicKey));
    assert.ok(auctionAccount.mintPubkey.equals(mint.publicKey));
    assert.ok(auctionAccount.tokenAccountPubkey.equals(tokenPubkey));
    assert.ok(auctionAccount.startingPrice.toNumber() == startingPrice);
    assert.ok(auctionAccount.reservedPrice.toNumber() == reservedPrice);
    assert.ok(auctionAccount.priceStep.toNumber() == priceStep);
    assert.ok(auctionAccount.interval.toNumber() == interval);
  });

  it("Auction", async () => {
    const takerTokenPubkey = await mint.createAccount(taker.publicKey);

    // const intervalCount = 1;
    // await sleep(interval * intervalCount);
    const tx = await program.rpc.buy(new anchor.BN(8000), {
      accounts: {
        taker: taker.publicKey,
        takerTokenAccount: takerTokenPubkey,
        initializer: initializer.publicKey,
        initializerTokenAccount: tokenPubkey,
        mintAccount: mint.publicKey,
        auctionAccount: auction,
        salesTaxRecipient: salesTaxRecipientPubkey,
        tokenAuthority: tokenAuthorityPda,
        metadataAccount: metadata,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        { pubkey: creator1.publicKey, isWritable: true, isSigner: false },
        { pubkey: creator2.publicKey, isWritable: true, isSigner: false },
      ],
      signers: [taker],
    });
    console.log("buy:", tx);

    const takerToken = await mint.getAccountInfo(takerTokenPubkey);
    assert.ok(takerToken.amount.toNumber() == 1);

    const salesTax = await connection.getAccountInfo(salesTaxRecipientPubkey);
    // TODO proper test for price drop, it took roughly 2-3 sec to this point
    // assert.ok(
    //   salesTax.lamports ==
    //     LISTING_FEE + (startingPrice - priceStep * 3) * SALES_TAX
    // );
    console.log(salesTax.lamports);
  });

  // it("Close Final Price", async () => {
  //   const tx = await program.rpc.closeFinalPrice({
  //     accounts: {
  //       finalPriceAccount,
  //       buyer: taker.publicKey,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     },
  //   });
  //   console.log(tx);
  // });
});

function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}
