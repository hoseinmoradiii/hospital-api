import { Injectable } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Appointment, AppointmentDocument } from './schema/appointment.schema';
import { Model, Schema } from 'mongoose';
import { ApiResponse, IApiResponse, IPagination } from '@/common/response';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { Roles } from '@/common/enums/role.enum';
import { Doctor, DoctorDocument } from '../doctor/schema/doctor.schema';
import { Patient, PatientDocument } from '../patient/schema/patient.schema';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Doctor.name)
    private readonly doctorModel: Model<DoctorDocument>,
    @InjectModel(Patient.name)
    private readonly patientModel: Model<PatientDocument>,
  ) {}

  async bookAppointment(
    patientId: Schema.Types.ObjectId,
    createAppointmentDto: CreateAppointmentDto,
  ): IApiResponse<AppointmentDocument> {
    const { date, doctorId } = createAppointmentDto;
    const appointment = await this.appointmentModel.create({
      doctorId,
      date,
      patientId,
    });

    if (!appointment)
      return ApiResponse.error(
        StatusCodes.BAD_REQUEST,
        ReasonPhrases.BAD_REQUEST,
        'an error happen',
      );

    return ApiResponse.success(
      StatusCodes.OK,
      ReasonPhrases.OK,
      '',
      appointment,
    );
  }

  async findMyAppointments(
    user: { userId: Schema.Types.ObjectId; role: string },
    paginationPayload: IPagination,
  ): IApiResponse<AppointmentDocument[]> {
    const { page = 1, pageSize = 10, total } = paginationPayload;
    const skip = (page - 1) * pageSize;
    const { role, userId } = user;

    if (role === Roles.PATIENT) {
      const patient = await this.patientModel.findOne({ userId });

      if (!patient)
        return ApiResponse.error(
          StatusCodes.NOT_FOUND,
          ReasonPhrases.NOT_FOUND,
          'no patient with this email exists',
        );

      const appointments = await this.appointmentModel
        .find({
          patientId: new Schema.Types.ObjectId(String(patient._id)),
        })
        .populate('doctorId')
        .sort({ date: 1 })
        .skip(skip)
        .limit(pageSize);

      return ApiResponse.success(
        StatusCodes.OK,
        ReasonPhrases.OK,
        '',
        appointments,
        this.buildPagination(total, page, pageSize),
      );
    }

    if (role === Roles.DOCTOR) {
      const doctor = await this.doctorModel.findOne({
        userId,
      });

      if (!doctor)
        return ApiResponse.error(
          StatusCodes.NOT_FOUND,
          ReasonPhrases.NOT_FOUND,
          'no doctor with this email exists',
        );
      const appointments = await this.appointmentModel
        .find({
          doctorId: new Schema.Types.ObjectId(String(doctor._id)),
        })
        .populate('patientId')
        .sort({ date: 1 })
        .skip(skip)
        .limit(pageSize);

      return ApiResponse.success(
        StatusCodes.OK,
        ReasonPhrases.OK,
        '',
        appointments,
        this.buildPagination(total, page, pageSize),
      );
    }

    const appointments = await this.appointmentModel
      .find()
      .sort({ date: 1 })
      .skip(skip)
      .limit(pageSize);

    const pagination = this.buildPagination(total, page, pageSize);
    return ApiResponse.success(
      StatusCodes.OK,
      ReasonPhrases.OK,
      '',
      appointments,
      pagination,
    );
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateAppointmentDto,
  ): IApiResponse<AppointmentDocument> {
    const { status } = updateStatusDto;
    const appointment = await this.appointmentModel.findByIdAndUpdate(
      id,
      { status },
      {
        new: true,
      },
    );
    if (!appointment)
      return ApiResponse.error(
        StatusCodes.NOT_FOUND,
        ReasonPhrases.NOT_FOUND,
        'Appointment not found',
      );
    return ApiResponse.success(
      StatusCodes.OK,
      ReasonPhrases.OK,
      `appointment status changed to ${status}`,
      appointment,
    );
  }

  private buildPagination = (
    total: number,
    page: number,
    pageSize: number,
  ): IPagination => ({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
