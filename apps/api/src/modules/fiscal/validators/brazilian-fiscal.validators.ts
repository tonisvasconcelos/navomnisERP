export function onlyDigits(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

export function isValidCpf(value?: string | null) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calc = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i += 1) total += Number(cpf[i]) * (factor - i);
    const digit = (total * 10) % 11;
    return digit === 10 ? 0 : digit;
  };

  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10]);
}

export function isValidCnpj(value?: string | null) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => acc + Number(cnpj[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return (
    calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13])
  );
}

export function hasValidNcmFormat(value?: string | null) {
  return !value || /^\d{8}$/.test(onlyDigits(value));
}

export function hasValidCfopFormat(value?: string | null) {
  return !value || /^[123567]\d{3}$/.test(onlyDigits(value));
}

export function hasValidCstFormat(value?: string | null) {
  return !value || /^\d{2,3}$/.test(onlyDigits(value));
}

export function hasValidMunicipalityCodeFormat(value?: string | null) {
  return !value || /^\d{7}$/.test(onlyDigits(value));
}
