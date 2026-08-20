# Spec: parsePhone

## Purpose
Implement E.164 phone number validator

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [x] parsePhone throws on malformed input, returns { countryCode, nationalNumber, raw }
- [x] validatePhone returns non-throwing discriminated result
- [x] formatPhone groups digits by 3 after country code
- [x] 18 vitest tests pass
