import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { VirtualEnvironmentConfig } from './config/virtual-environment.config';
import { MongoDbConfig } from './config/mongodb.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { PatientModule } from './modules/patient/patient.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiResponseStatusInterceptor } from './common/interceptors/api-response-status.interceptor';

@Module({
  imports: [
    VirtualEnvironmentConfig(),
    MongoDbConfig(),
    AuthModule,
    UserModule,
    AppointmentModule,
    DoctorModule,
    PatientModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseStatusInterceptor },
  ],
})
export class AppModule {}
