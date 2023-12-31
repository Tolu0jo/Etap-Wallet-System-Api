import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RepositoryService } from 'src/Repository/repository.service';
import { Status } from 'src/interface/enum';
import { TransactionsQueryDto } from './dto/transaction-query.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AdminService {
  constructor(private repository: RepositoryService) {}

  async getAllTransactions(userInfo: IUser) {
    try {
      const { id, isAdmin } = userInfo;
      if (!isAdmin || !id)
        return new HttpException(
          'Unauthorised User signin as an admin',
          HttpStatus.UNAUTHORIZED,
        );
      return await this.repository.transaction.findMany();
    } catch (error) {
      return new HttpException(
        `${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getTransaction(userInfo: IUser, txId: string) {
    try {
      const { id, isAdmin } = userInfo;
      if (!isAdmin || !id)
        return new HttpException(
          'Unauthorised User signin as an admin',
          HttpStatus.UNAUTHORIZED,
        );
    const transaction =await this.repository.transaction.findUnique({
        where: {
          id:txId,
        }
      });
    if(!transaction) return new HttpException("transaction not found",HttpStatus.NOT_FOUND);
    return transaction;
    } catch (error) {
      return new HttpException(
        `${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPayment(userInfo: IUser, pId: string) {
    try {
      const { id, isAdmin } = userInfo;
      if (!isAdmin || !id)
        return new HttpException(
          'Unauthorised User signin as an admin',
          HttpStatus.UNAUTHORIZED,
        );
      return await this.repository.paymentDetails.findUnique({
        where: {
          id:pId
        },
      });
    } catch (error) {
      return new HttpException(
        `${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPayments(userInfo: IUser) {
    const { id, isAdmin } = userInfo;
    if (!isAdmin || !id)
      return new HttpException(
        'Unauthorised User signin as an admin',
        HttpStatus.UNAUTHORIZED,
      );
    return await this.repository.paymentDetails.findMany();
  }

  async getAllPendingTransactions(userInfo: IUser) {
    try {
      const { isAdmin } = userInfo;
      if (!isAdmin)
        return new HttpException('Unauthorised User', HttpStatus.UNAUTHORIZED);
      return await this.repository.transaction.findMany({
        where: {
          status: Status.PENDING,
        },
      });
    } catch (error) {
      return new HttpException(
        `${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllApprovedTransactions(userInfo: IUser) {
    try {
      const { id, isAdmin } = userInfo;
      if (!isAdmin || !id)
        return new HttpException(
          'Unauthorised User signin as an admin',
          HttpStatus.UNAUTHORIZED,
        );
      return await this.repository.transaction.findMany({
        where: {
          status: Status.APPROVED,
        },
      });
    } catch (error) {
      return new HttpException(
        `${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async approveTransaction(txnId: string, userInfo: IUser) {
    try {
      const { id, isAdmin } = userInfo;
      if (!isAdmin || !id)
        return new HttpException(
          'Unauthorised User signin as an admin',
          HttpStatus.UNAUTHORIZED,
        );

      const transaction = await this.repository.transaction.findUnique({
        where: {
          id: txnId,
          status: Status.PENDING,
        },
      });

      if (!transaction)
        return new HttpException(
          'Transactions Already Approved or Not Found',
          HttpStatus.BAD_REQUEST,
        );

      const { senderWalletId, recieverWalletId, amount } = transaction;

      const senderWallet = await this.repository.wallet.findUnique({
        where: {
          id: senderWalletId,
        },
      });

      const recieverWallet = await this.repository.wallet.findUnique({
        where: {
          id: recieverWalletId,
        },
      });

      if (senderWallet && recieverWallet) {
        const senderBalance = senderWallet.balance - amount;
        const recieverBalance = recieverWallet.balance + amount;
        await this.repository.wallet.update({
          where: {
            id: senderWalletId,
          },
          data: {
            balance: senderBalance,
          },
        });

        await this.repository.wallet.update({
          where: {
            id: recieverWalletId,
          },
          data: {
            balance: recieverBalance,
          },
        });

        const approvedtransaction = await this.repository.transaction.update({
          where: {
            id: txnId,
          },
          data: {
            status: Status.APPROVED,
            approvedById: id,
          },
        });
        return approvedtransaction;
      } else {
        return new HttpException(
          'Only admin can approve transactions',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } catch (error) {
      return new HttpException(
        `${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generatePaymentSummary(month: number, year: number) {
    const startDate = new Date(+year, +month - 1, 1);
    const endDate = new Date(+year, +month + 1, 0);

    const payments = await this.repository.paymentDetails.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalPayments = payments.length;
    const successfulPayments = payments.filter(
      (payment) => payment.pstackId !== null,
    ).length;
    const pendingPayments = totalPayments - successfulPayments;

    const paymentSummary = {
      month,
      year,
      totalPayments,
      successfulPayments,
      pendingPayments,
    };

    return paymentSummary;
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyPaymentSummary() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    await this.generatePaymentSummary(month, year);
  }

  async getMonthlyPaymentSummaries(userInfo: IUser) {
    try {
      const { id, isAdmin } = userInfo;
      if (!isAdmin || !id)
        return new HttpException(
          'Unauthorised User signin as an admin',
          HttpStatus.UNAUTHORIZED,
        );
      return await this.repository.paymentSummary.findMany({});
    } catch (error) {
      return new HttpException(
        `${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
