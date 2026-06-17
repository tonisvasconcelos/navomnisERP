import { BadRequestException } from '@nestjs/common';

export class MissingUomConversionException extends BadRequestException {
  constructor(message = 'Conversão de UOM não encontrada para este artigo.') {
    super({ code: 'MISSING_UOM_CONVERSION', message });
  }
}
