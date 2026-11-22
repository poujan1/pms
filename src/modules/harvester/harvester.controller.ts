import { Request, Response, NextFunction } from 'express';
import { HarvesterService } from './harvester.service';
import { sendResponse } from '../../utils/apiResponse';

export class HarvesterController {
  static async listMachines(req: Request, res: Response, next: NextFunction) {
    try {
      const machines = await HarvesterService.listMachines();
      return sendResponse({ res, data: machines });
    } catch (error) {
      next(error);
    }
  }

  static async createMachine(req: Request, res: Response, next: NextFunction) {
    try {
      const machine = await HarvesterService.createMachine(req.body);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Harvester Machine registered successfully',
        data: machine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listWorkLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { farmerId, machineId } = req.query as { farmerId?: string; machineId?: string };
      const logs = await HarvesterService.listWorkLogs(farmerId, machineId);
      return sendResponse({ res, data: logs });
    } catch (error) {
      next(error);
    }
  }

  static async logWork(req: Request, res: Response, next: NextFunction) {
    try {
      const log = await HarvesterService.logWork(req.body, req.user!.id);
      return sendResponse({
        res,
        statusCode: 201,
        message: 'Harvester work recorded and posted',
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await HarvesterService.getSummary();
      return sendResponse({ res, data: summary });
    } catch (error) {
      next(error);
    }
  }
}
