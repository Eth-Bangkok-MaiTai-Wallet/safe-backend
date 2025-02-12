import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class Safe extends Document {
  @Prop({ required: true })
  safeAddress!: string;

  @Prop({ required: true })
  chainId!: number;

  @Prop({ type: [String], default: [] })
  safeLegacyOwners!: string[];

  @Prop({ type: [String], default: [] })
  safeModuleOwners!: string[];

  @Prop()
  safeModulePasskey?: string;
}

export const SafeSchema = SchemaFactory.createForClass(Safe); 