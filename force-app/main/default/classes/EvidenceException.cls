/**
 * EvidenceException
 * The single shared exception type for the Evidence package (CONTRACT.md 9.1).
 *
 * Every service throws this rather than a raw Exception so callers and the UI
 * facade can distinguish an Evidence policy/validation failure from a platform
 * error. Custom Apex exceptions get their String / String+Exception constructors
 * implicitly, which is why callers can write `new EvidenceException('msg')`.
 *
 * Note: the `with sharing` keyword is not valid on a class that extends
 * Exception and would carry no meaning here (an exception performs no SOQL/DML),
 * so it is intentionally omitted while every service class remains with sharing.
 */
public class EvidenceException extends Exception {
}
