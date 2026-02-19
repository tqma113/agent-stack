import CDP from "chrome-remote-interface";

export class IODomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Read a chunk of the stream
   */
  async read(options: { handle: string; offset?: number; size?: number }): Promise<{
    base64Encoded?: boolean;
    data: string;
    eof: boolean;
  }> {
    const client = this.getClient();
    return (client as any).IO.read(options);
  }

  /**
   * Close the stream
   */
  async close(handle: string): Promise<void> {
    const client = this.getClient();
    await (client as any).IO.close({ handle });
  }

  /**
   * Return UUID of Blob object specified by a remote object id
   */
  async resolveBlob(objectId: string): Promise<{ uuid: string }> {
    const client = this.getClient();
    return (client as any).IO.resolveBlob({ objectId });
  }
}
