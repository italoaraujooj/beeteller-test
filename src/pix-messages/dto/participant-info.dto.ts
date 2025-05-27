import { ApiProperty } from '@nestjs/swagger';

export class ParticipantInfoDto {
  @ApiProperty({
    example: 'João Silva Teste',
    description: 'Nome do pagador ou recebedor.',
    type: String,
  })
  nome: string;

  @ApiProperty({
    example: '11122233344',
    description:
      'CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador ou recebedor.',
    type: String,
  })
  cpfCnpj: string;

  @ApiProperty({
    example: '12345678',
    description: 'ISPB da instituição do pagador ou recebedor.',
    type: String,
    maxLength: 8,
  })
  ispb: string;

  @ApiProperty({
    example: '0001',
    description: 'Agência bancária do pagador ou recebedor.',
    type: String,
  })
  agencia: string;

  @ApiProperty({
    example: '1234567',
    description: 'Número da conta transacional do pagador ou recebedor.',
    type: String,
  })
  contaTransacional: string;

  @ApiProperty({
    example: 'CACC',
    description:
      'Tipo da conta do pagador ou recebedor (ex: CACC, SLRY, SVGS, TRAN).',
    type: String,
  })
  tipoConta: string;
}
