// IcaoInput.js — v6.0 — powered by airports_db (5.800+ aeródromos ANAC)
import React from 'react';
import AirportSearchInput from './AirportSearchInput';

/**
 * IcaoInput — wrapper sobre AirportSearchInput.
 * Mantém a mesma API de antes (value, onChange, placeholder, label, required)
 * mas agora busca em tempo real nos 5.800+ aeródromos da base ANAC.
 * onChange(icao, airportObj) — icao é string, airportObj é o objeto completo.
 */
export default function IcaoInput({ value, onChange, placeholder = 'SBGR', label, required, className }) {
  return (
    <AirportSearchInput
      value={value || ''}
      onChange={(icao, airport) => {
        // Compatibilidade com chamadas antigas que esperam só a string ICAO
        if (typeof onChange === 'function') onChange(icao, airport);
      }}
      placeholder={placeholder}
      label={label}
      required={required}
      className={className}
    />
  );
}
