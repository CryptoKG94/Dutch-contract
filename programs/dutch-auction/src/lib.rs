pub mod metadata;
use anchor_lang::{prelude::*, solana_program::system_program, accounts::program_account::ProgramAccount};
use anchor_spl::token::{Mint, TokenAccount};
use spl_token::instruction::{approve, revoke};

declare_id!("ATr4QpNHBjnT14tUEei26zsyMo6AyN9yaAoeLhg3ue26");

const SALES_TAX_RECIPIENT_INTERNAL: &str = "3iYf9hHQPciwgJ1TCjpRUp1A3QW4AfaK7J6vCmETRMuu";
const SALES_TAX: u64 = 99;

const PREFIX: &[u8] = b"dutchauction";

#[program]
pub mod dutch_auction {
    use super::*;
    use crate::metadata::{get_metadata_account, EscrowError, Metadata};
    use anchor_lang::solana_program::{
        program::{invoke, invoke_signed},
        system_instruction,
    };

    /**
    Function to do auction.
    buyer can do auction by using function.
    main function: NFT approve
     */
    pub fn init_auction(
        ctx: Context<InitAuction>,
        starting_price: u64,
        reserved_price: u64,
        price_step: u64,
        interval: u64,
        auction_bump: u8,
    ) -> ProgramResult {
        let auction = &mut ctx.accounts.auction_account;
        let token_program = &ctx.accounts.token_program;
        let initializer = &ctx.accounts.initializer;
        let mint_account = &ctx.accounts.mint_account;
        let token_account = &ctx.accounts.token_account;
        let token_authority = &ctx.accounts.token_authority;
        auction.initializer_pubkey = initializer.key();
        auction.mint_pubkey = mint_account.key();
        auction.token_account_pubkey = token_account.key();
        auction.starting_price = starting_price;
        auction.reserved_price = reserved_price;
        auction.price_step = price_step;
        auction.interval = interval;
        auction.starting_ts = ctx.accounts.clock.unix_timestamp;
        auction.bump = auction_bump;

        let (_token_authority, token_authority_bump) =
            Pubkey::find_program_address(&[PREFIX], ctx.program_id);

        let token_amount = 10_u64.pow(mint_account.decimals as u32);

        let authority_seeds = [PREFIX, &[token_authority_bump]];
        invoke_signed(
            &approve(
                &token_program.key(),
                &token_account.key(),
                &token_authority.key(),
                &initializer.key(),
                &[],
                token_amount,
            )
            .unwrap(),
            &[
                token_program.to_account_info(),
                token_account.to_account_info(),
                token_authority.to_account_info(),
                initializer.to_account_info(),
            ],
            &[&authority_seeds],
        )?;

        msg!("Listed");
        Ok(())
    }

    /**
    Function to cancel auction.
    user cancels auction by using revoke function.
     */
    pub fn cancel_auction<'info>(ctx: Context<CancelAuction>) -> ProgramResult {
        let token_program = &ctx.accounts.token_program;
        let initializer = &ctx.accounts.initializer;
        let token_account = &ctx.accounts.token_account;

        let (_token_authority, token_authority_bump) =
            Pubkey::find_program_address(&[PREFIX], ctx.program_id);

        let authority_seeds = [PREFIX, &[token_authority_bump]];
        invoke_signed(
            &revoke(
                &token_program.key(),
                &token_account.key(),
                &initializer.key(),
                &[],
            )
            .unwrap(),
            &[
                token_program.to_account_info(),
                token_account.to_account_info(),
                initializer.to_account_info(),
            ],
            &[&authority_seeds],
        )?;

        msg!("Cancel Listing");

        Ok(())
    }

    /**
    Buy function. it has royalty and tax fee function.
     */
    pub fn buy<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, DutchAuction<'info>>,
        fe_price: u64,
    ) -> ProgramResult {
        let auction = &mut ctx.accounts.auction_account;
        let token_program = &ctx.accounts.token_program;
        let initializer = &ctx.accounts.initializer;
        let initializer_token_account = &ctx.accounts.initializer_token_account;
        let taker_token_account = &ctx.accounts.taker_token_account;
        let token_authority = &ctx.accounts.token_authority;

        let (_token_authority, token_authority_bump) =
            Pubkey::find_program_address(&[PREFIX], ctx.program_id);

        let authority_seeds = [PREFIX, &[token_authority_bump]];

        // if taker == initializer, return the token
        // initializer can't buy. 
        if *ctx.accounts.taker.key == auction.initializer_pubkey {
            invoke_signed(
                &revoke(
                    &token_program.key(),
                    &initializer_token_account.key(),
                    &initializer.key(),
                    &[],
                )
                .unwrap(),
                &[
                    token_program.to_account_info(),
                    initializer_token_account.to_account_info(),
                    initializer.to_account_info(),
                ],
                &[&authority_seeds],
            )?;
            return Ok(());
        }

        // normal auction
        let current_ts = ctx.accounts.clock.unix_timestamp;
        let price_drop_cnt =
            (current_ts - auction.starting_ts).wrapping_div(auction.interval as i64);

        let current_price =
            auction.starting_price - auction.price_step.wrapping_mul(price_drop_cnt as u64);

        let final_price: u64;
        if current_price > auction.reserved_price {
            final_price = current_price;
        } else {
            final_price = auction.reserved_price;
        }
        if fe_price < final_price || fe_price > final_price + auction.price_step {
            return Err(ErrorCode::IncorrectFrontendPrice.into());
        }

        let metadata = &ctx.accounts.metadata_account;
        let correct_metadata =
            get_metadata_account(ctx.accounts.mint_account.to_account_info().key);
        if &correct_metadata != metadata.key {
            msg!(
                "Mint-derived metadata account {:?} doesn't match passed metadata account {:?}",
                &correct_metadata,
                metadata.key
            );
            return Err(EscrowError::InvalidMetadata.into());
        }

        // royalty for creators
        let creators = &ctx.remaining_accounts;
        let meta_res = Metadata::from_u8(&metadata.data.borrow_mut());
        let mut royalty_total: u64 = 0;
        if meta_res.is_ok() {
            let md = meta_res.unwrap();
            if md.data.seller_fee_basis_points as u64 + SALES_TAX > 10000 {
                return Err(EscrowError::InvalidRoyaltyFee.into());
            }
            royalty_total = (md.data.seller_fee_basis_points as u64 * fe_price) / 10000;

            msg!("Distributing creator royalties");

            // TODO check verified status
            match md.data.creators {
                Some(md_creators) => {
                    if md_creators.len() != creators.len() {
                        msg!("number of creators in metadata {:?} doesn't match number of creators passed {:?}", md_creators.len(), creators.len());
                        return Err(EscrowError::CreatorMismatch.into());
                    }
                    for (i, mcreator) in md_creators.iter().enumerate() {
                        let creator = &creators[i];
                        if mcreator.address != *creator.key {
                            msg!(
                                "creator {:?} in metadata {:?} doesn't match creator passed {:?}",
                                i,
                                mcreator.address,
                                creator.key
                            );
                            return Err(EscrowError::CreatorMismatch.into());
                        }

                        let creator_royalty = (mcreator.share as u64 * royalty_total) / 100;
                        invoke(
                            &system_instruction::transfer(
                                ctx.accounts.taker.key,
                                creator.key,
                                creator_royalty,
                            ),
                            &[
                                ctx.accounts.taker.clone(),
                                creator.clone(),
                                ctx.accounts.system_program.clone(),
                            ],
                        )?;
                    }
                }
                None => msg!("no creators => no payouts"),
            }
        } else {
            if let Err(e) = meta_res {
                msg!(
                    "no metadata found or metadata invalid, skipping royalties: {:?}",
                    e
                );
            }
        }

        // tax payout
        // contract owner gets tax fee.
        let tax_amount = (SALES_TAX * fe_price) / 10000;
        invoke(
            &system_instruction::transfer(
                ctx.accounts.taker.key,
                ctx.accounts.sales_tax_recipient.key,
                tax_amount,
            ),
            &[
                ctx.accounts.taker.clone(),
                ctx.accounts.sales_tax_recipient.clone(),
                ctx.accounts.system_program.clone(),
            ],
        )?;

        // money to initializer
        let initializer_amount = fe_price - tax_amount - royalty_total;
        invoke(
            &system_instruction::transfer(
                ctx.accounts.taker.key,
                ctx.accounts.initializer.key,
                initializer_amount,
            ),
            &[
                ctx.accounts.taker.clone(),
                ctx.accounts.initializer.clone(),
                ctx.accounts.system_program.clone(),
            ],
        )?;

        // NFT to buyer.
        let token_amount = 10_u64.pow(ctx.accounts.mint_account.decimals as u32);
        invoke_signed(
            &spl_token::instruction::transfer(
                token_program.key,
                initializer_token_account.to_account_info().key,
                taker_token_account.to_account_info().key,
                token_authority.key,
                &[],
                token_amount,
            )?,
            &[
                initializer_token_account.to_account_info(),
                taker_token_account.to_account_info(),
                token_authority.clone(),
                token_program.to_account_info(),
            ],
            &[&authority_seeds],
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(starting_price: u64, reserved_price: u64, price_step: u64, interval: u64, auction_bump: u8)]
pub struct InitAuction<'info> {
    #[account(mut, signer)]
    initializer: AccountInfo<'info>,
    #[account(mut, constraint = &token_account.owner == initializer.key, constraint = &token_account.mint == mint_account.to_account_info().key)]
    token_account: Box<Account<'info, TokenAccount>>,
    mint_account: Box<Account<'info, Mint>>,
    token_authority: AccountInfo<'info>,
    #[account(
        init,
        seeds=[PREFIX, initializer.key().as_ref(), mint_account.to_account_info().key().as_ref()],
        bump=auction_bump,
        payer=initializer,
        space=8+32*3+8*6+1,
    )]
    auction_account: ProgramAccount<'info, AuctionAccount>,
    #[account(address = system_program::ID)]
    system_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
    #[account(address = spl_token::id())]
    token_program: AccountInfo<'info>,
    clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct CancelAuction<'info> {
    #[account(mut, signer)]
    initializer: AccountInfo<'info>,
    #[account(mut, constraint = &token_account.owner == initializer.key, constraint = &token_account.mint == mint_account.to_account_info().key)]
    token_account: Box<Account<'info, TokenAccount>>,
    mint_account: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds=[PREFIX, initializer.key().as_ref(), mint_account.to_account_info().key().as_ref()],
        bump=auction_account.bump,
        close = initializer
    )]
    auction_account: ProgramAccount<'info, AuctionAccount>,
    token_authority: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    system_program: AccountInfo<'info>,
    #[account(address = spl_token::id())]
    token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(fe_price: u64)]
pub struct DutchAuction<'info> {
    #[account(mut, signer)]
    taker: AccountInfo<'info>,
    #[account(mut, constraint = &taker_token_account.mint == mint_account.to_account_info().key)]
    taker_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    initializer: AccountInfo<'info>,
    #[account(mut, constraint = &initializer_token_account.mint == mint_account.to_account_info().key)]
    initializer_token_account: Box<Account<'info, TokenAccount>>,
    mint_account: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds=[PREFIX, initializer.key().as_ref(), mint_account.to_account_info().key().as_ref()],
        bump=auction_account.bump,
        close = initializer
    )]
    auction_account: ProgramAccount<'info, AuctionAccount>,
    #[account(mut, constraint = sales_tax_recipient.key.to_string() == SALES_TAX_RECIPIENT_INTERNAL)]
    sales_tax_recipient: AccountInfo<'info>,
    token_authority: AccountInfo<'info>,
    metadata_account: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    system_program: AccountInfo<'info>,
    #[account(address = spl_token::id())]
    token_program: AccountInfo<'info>,
    clock: Sysvar<'info, Clock>,
}

#[account]
pub struct AuctionAccount {
    pub initializer_pubkey: Pubkey,
    pub mint_pubkey: Pubkey,
    pub token_account_pubkey: Pubkey,
    pub starting_price: u64,
    pub reserved_price: u64,
    pub price_step: u64,
    pub interval: u64,
    pub starting_ts: i64,
    pub bump: u8,
}

#[error]
pub enum ErrorCode {
    #[msg("Incorrect Frontend Price")]
    IncorrectFrontendPrice,
}
