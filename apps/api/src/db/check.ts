import mongoose from 'mongoose';
import { env } from '../config/env.js';

// Connection diagnostic: npm run db:check Exists because MongoDB connection failures are the single most common setup prob
function redactUri(uri: string): string {
  return uri.replace(/:\/\/([^:@/]+):([^@]+)@/, '://$1:••••••@');
}

function diagnose(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/bad auth|Authentication failed/i.test(message)) {
    return [
      'The username or password is wrong.',
      '',
      '  • Check them in Atlas → Database Access.',
      '  • If the password contains @ : / ? # [ ] it must be percent-encoded,',
      '    or the driver reads it as part of the hostname. Easiest fix is to',
      '    reset the password to letters and digits only.',
    ].join('\n');
  }

  if (/IP|whitelist|allowlist|not allowed/i.test(message)) {
    return [
      'This machine is not on the cluster IP allowlist.',
      '',
      '  • Atlas → Network Access → Add IP Address → Allow Access from Anywhere.',
    ].join('\n');
  }

  /*
   * Order matters: a failed SRV lookup reports as `querySrv ECONNREFUSED`, which
   * matches the plain ECONNREFUSED test below and would otherwise be diagnosed as
   * "nothing listening on that port" - sending the reader to check a server that
   * was never contacted. The DNS cases are therefore tested first.
   */
  if (/querySrv|queryTxt/i.test(message)) {
    return [
      'The DNS lookup for the cluster was refused or failed.',
      '',
      '  A mongodb+srv:// URI needs an SRV record lookup, which needs direct DNS',
      '  on port 53. This usually means the network is blocking it, not that',
      '  anything is wrong with the cluster or the credentials.',
      '',
      '  • Corporate, campus or sandboxed networks commonly block port 53.',
      '    Try a phone hotspot to confirm.',
      '  • Some ISP resolvers do not return SRV records. Switching the machine to',
      '    1.1.1.1 or 8.8.8.8 fixes it.',
      '  • As a last resort, Atlas can issue a non-SRV mongodb:// string that lists',
      '    the shard hosts directly and needs no SRV lookup.',
    ].join('\n');
  }

  if (/ENOTFOUND|getaddrinfo/i.test(message)) {
    return [
      'The cluster hostname could not be resolved.',
      '',
      '  • Check for a typo in the host part of the connection string.',
      '  • A mongodb+srv:// URI must have no port number.',
    ].join('\n');
  }

  if (/ECONNREFUSED/i.test(message)) {
    return [
      'Nothing is listening at that address.',
      '',
      '  • If this is a local mongod, it is not running.',
      '  • If this is Atlas, MONGODB_URI is probably still the local default.',
    ].join('\n');
  }

  if (/<|>/.test(env.MONGODB_URI)) {
    return 'The connection string still contains a < > placeholder. Replace it, brackets included.';
  }

  return 'Unrecognised failure. The full driver message is above.';
}

async function main(): Promise<void> {
  process.stdout.write(`\nConnecting to ${redactUri(env.MONGODB_URI)}\n`);

  const started = Date.now();
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 12_000 });

    const connection = mongoose.connection;
    const admin = connection.db?.admin();
    const info = await admin?.serverStatus().catch(() => null);
    const collections = (await connection.db?.listCollections().toArray()) ?? [];

    process.stdout.write(
      [
        '',
        `  Connected in ${Date.now() - started} ms`,
        `  Database:      ${connection.name}`,
        info?.version ? `  Server:        MongoDB ${String(info.version)}` : '',
        `  Collections:   ${collections.length === 0 ? 'none yet, run "npm run seed -- --demo"' : collections.map((c) => c.name).sort().join(', ')}`,
        '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    if (connection.name === 'test') {
      process.stdout.write(
        '  Warning: the database is named "test". Add /shadowscan before the "?"\n' +
          '  in MONGODB_URI, or your data will land in the wrong place.\n\n',
      );
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    process.stdout.write(`\n  Could not connect after ${Date.now() - started} ms.\n\n`);
    process.stdout.write(`  ${error instanceof Error ? error.message : String(error)}\n\n`);
    process.stdout.write(`${diagnose(error)}\n\n`);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  }
}

void main();
