import CDP from "chrome-remote-interface";

export interface GPUDevice {
  vendorId: number;
  deviceId: number;
  subSysId?: number;
  revision?: number;
  vendorString: string;
  deviceString: string;
  driverVendor: string;
  driverVersion: string;
}

export interface Size {
  width: number;
  height: number;
}

export interface VideoDecodeAcceleratorCapability {
  profile: string;
  maxResolution: Size;
  minResolution: Size;
}

export interface VideoEncodeAcceleratorCapability {
  profile: string;
  maxResolution: Size;
  maxFramerateNumerator: number;
  maxFramerateDenominator: number;
}

export interface SubsamplingFormat {
  format: string;
}

export interface ImageType {
  imageType: string;
}

export interface ImageDecodeAcceleratorCapability {
  imageType: string;
  maxDimensions: Size;
  minDimensions: Size;
  subsamplings: string[];
}

export interface GPUInfo {
  devices: GPUDevice[];
  auxAttributes?: any;
  featureStatus?: any;
  driverBugWorkarounds: string[];
  videoDecoding: VideoDecodeAcceleratorCapability[];
  videoEncoding: VideoEncodeAcceleratorCapability[];
  imageDecoding: ImageDecodeAcceleratorCapability[];
}

export interface ProcessInfo {
  type: string;
  id: number;
  cpuTime: number;
}

export class SystemInfoDomain {
  constructor(private getClient: () => CDP.Client) {}

  /**
   * Returns information about the system
   */
  async getInfo(): Promise<{
    gpu: GPUInfo;
    modelName: string;
    modelVersion: string;
    commandLine: string;
  }> {
    const client = this.getClient();
    return (client as any).SystemInfo.getInfo();
  }

  /**
   * Returns information about the feature state
   */
  async getFeatureState(featureState: string): Promise<{ featureEnabled: boolean }> {
    const client = this.getClient();
    return (client as any).SystemInfo.getFeatureState({ featureState });
  }

  /**
   * Returns information about all running processes
   */
  async getProcessInfo(): Promise<{ processInfo: ProcessInfo[] }> {
    const client = this.getClient();
    return (client as any).SystemInfo.getProcessInfo();
  }
}
