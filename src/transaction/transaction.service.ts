import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RepositoryService } from 'src/Repository/repository.service';
import { TransferDto } from './dto/transfer.dto';
import { v4 as uuidv4 } from 'uuid';
import { Status } from 'src/interface/enum';

@Injectable()
export class TransactionService {
  constructor(private repository: RepositoryService) {}

  async transfer(
    userInfo: IUser,
    senderWalletId: string,
    transferDto: TransferDto,
  ) {
    try {
      const { recieverWalletId, amount } = transferDto;
      const { id, isAdmin } = userInfo;

      if (isAdmin)
        throw new UnauthorizedException('Admin cannot make wallet transfers');
      const senderWallet = await this.repository.wallet.findFirst({
        where: {
          id: senderWalletId,
          userId: id,
        },
      });
      if (!senderWallet) throw new NotFoundException(`wallet does not exist`);

      const recieverWallet = await this.repository.wallet.findUnique({
        where: {
          id: recieverWalletId,
        },
      });
      if (!recieverWallet) throw new NotFoundException(`wallet does not exist`);
      if (senderWallet.currency !== recieverWallet.currency)
        throw new ConflictException(
          'reciever wallet should accept same currency',
        );
      if (amount > senderWallet.balance)
        throw new ConflictException(
          'Insufficient balance to make the transaction',
        );
      if (amount <= 1_000_000) {
        const senderBalance = senderWallet.balance - amount;
        await this.repository.wallet.update({
          where: {
            id: senderWalletId,
            userId: id,
          },
          data: {
            balance: senderBalance,
          },
        });

        const recieverBalance = senderWallet.balance + amount;

        await this.repository.wallet.update({
          where: {
            id: recieverWalletId,
          },
          data: {
            balance: recieverBalance,
          },
        });

        const approvedTransaction = await this.repository.transaction.create({
          data: {
            id: uuidv4(),
            senderWalletId,
            recieverWalletId,
            amount,
            userId: id,
          },
        });

        return { approvedTransaction, myWalletBallance: senderBalance };
      } else {
        const pendingTransaction = await this.repository.transaction.create({
          data: {
            id: uuidv4(),
            senderWalletId,
            recieverWalletId,
            amount,
            userId: id,
            status: Status.PENDING,
          },
        });
        return pendingTransaction;
      }
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async getTransactions(userInfo: IUser) {
    const { id, isAdmin } = userInfo;
    if (isAdmin)
      throw new UnauthorizedException('Admin cannot make wallet transfers');
    return await this.repository.transaction.findMany({
      where: {
        userId: id,
      },
    });
  }

  async getTransaction(txnId: string, userInfo: IUser) {
    const { id, isAdmin } = userInfo;
    if (isAdmin) throw new UnauthorizedException();
    return await this.repository.transaction.findUnique({
      where: {
        id: txnId,
        userId: id,
      },
    });
  }

  async getPendingTransactions(userInfo: IUser) {
    try {
      const { id, isAdmin } = userInfo;
      if (isAdmin) throw new UnauthorizedException();
      return await this.repository.transaction.findMany({
        where: {
          userId: id,
          status: Status.PENDING,
        },
      });
      
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getApprovedTransactions(userInfo: IUser) {
    try {
      const { id, isAdmin } = userInfo;
      if (isAdmin) throw new UnauthorizedException();
      const transactions = await this.repository.transaction.findMany({
        where: {
          userId: id,
          status: Status.APPROVED,
        },
      });
      return transactions;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
